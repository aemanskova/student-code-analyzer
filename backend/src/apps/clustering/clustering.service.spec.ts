import { BadRequestException } from "@nestjs/common";
import { AnalysisJob } from "../analysis/entities/analysis-job.entity";
import { AnalysisResult } from "../analysis/entities/analysis-result.entity";
import { ClusteringService } from "./clustering.service";

type RepositoryMock<T> = {
  find: jest.Mock<Promise<T[]>, unknown[]>;
  createQueryBuilder?: jest.Mock;
};

const featureMetrics = {
  active_days: 9,
  churn_ratio: "0.25",
  development_duration_days: 4,
  semantic_element_usage_ratio_overall: 0.7,
  total_lines_added: 99,
  form_controls_missing_label_ratio: 0.1,
  img_missing_alt_ratio: 0.2,
  vnu_errors_total: 2,
  vnu_warnings_total: 3,
  axe_critical: 1,
  image_bytes_total: 1024,
  complex_selectors_ratio_avg: 0.4,
  uses_webp: "true",
  median_commit_size: 12,
  specificity_variance_overall: 0.8,
  night_commit_pct: 0.3,
  font_bytes_total: 2048,
  heading_order_violations_total: 1,
  avg_font_size_bytes: 256,
  duplicate_ids_total: 0,
  import_count_total: 5,
  css_files: 1,
  css_bytes_total: 100,
  html_bytes_total: 200,
  html_files: 1,
  extra_metric: 42
};

const makeRow = (
  id: number,
  path: string,
  metrics: Record<string, string | number | null> = {}
): AnalysisResult =>
  ({
    id,
    userId: 1,
    runId: "run-1",
    direction: "html_css",
    path,
    cacheKey: null,
    groupValue: null,
    studentValue: null,
    metrics: {
      ...featureMetrics,
      ...metrics
    },
    createdAt: new Date("2026-05-03T00:00:00.000Z")
  }) as unknown as AnalysisResult;

const makeJob = (depth: number): AnalysisJob =>
  ({ requestPayload: { depth } }) as unknown as AnalysisJob;

const createJobQueryBuilder = (job: AnalysisJob | null) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(job)
});

const createMockSklearn = (labels: number[], captured: { scaledInput?: number[][] } = {}) => {
  class RobustScaler {
    async init() {
      return undefined;
    }

    async fit_transform(opts: { X: number[][] }) {
      captured.scaledInput = opts.X;
      return opts.X;
    }

    async dispose() {
      return undefined;
    }
  }

  class NearestNeighbors {
    async init() {
      return undefined;
    }

    async fit() {
      return undefined;
    }

    async kneighbors() {
      return [
        [
          [0, 0.1, 0.2, 0.3, 0.4],
          [0, 0.1, 0.2, 0.3, 0.45],
          [0, 0.1, 0.2, 0.3, 0.5],
          [0, 0.1, 0.2, 0.3, 1.8],
          [0, 0.1, 0.2, 0.3, 2.2]
        ],
        [
          [0, 1, 2, 3, 4],
          [1, 0, 2, 3, 4],
          [2, 0, 1, 3, 4],
          [3, 0, 1, 2, 4],
          [4, 0, 1, 2, 3]
        ]
      ];
    }

    async dispose() {
      return undefined;
    }
  }

  class DBSCAN {
    async init() {
      return undefined;
    }

    async fit_predict() {
      return labels;
    }

    async dispose() {
      return undefined;
    }
  }

  return {
    createPythonBridge: jest
      .fn()
      .mockResolvedValue({ end: jest.fn().mockResolvedValue(undefined) }),
    RobustScaler,
    NearestNeighbors,
    DBSCAN
  };
};

const createService = (
  rows: AnalysisResult[],
  job: AnalysisJob | null = makeJob(3),
  labels = [0, 0, 1, 1, -1],
  captured: { scaledInput?: number[][] } = {}
) => {
  const resultRepo: RepositoryMock<AnalysisResult> = {
    find: jest.fn().mockResolvedValue(rows)
  };
  const jobRepo: RepositoryMock<AnalysisJob> = {
    find: jest.fn(),
    createQueryBuilder: jest.fn().mockReturnValue(createJobQueryBuilder(job))
  };
  const service = new ClusteringService(resultRepo as never, jobRepo as never);
  Object.defineProperty(service, "loadSklearn", {
    value: jest.fn().mockResolvedValue(createMockSklearn(labels, captured))
  });
  return service;
};

describe("ClusteringService", () => {
  it("rejects non html_css runs", async () => {
    const service = createService([{ ...makeRow(1, "g/s/w"), direction: "js" } as AnalysisResult]);

    await expect(service.getClusters(1, "run-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("filters invalid rows, applies numeric/log preprocessing, and returns clustered rows", async () => {
    const captured: { scaledInput?: number[][] } = {};
    const rows = [
      makeRow(1, "g1/s1/work1"),
      makeRow(2, "g1/s1/work2"),
      makeRow(3, "g1/s2/work3"),
      makeRow(4, "g2/s3/work4"),
      makeRow(5, "g2/s3/work5"),
      makeRow(6, "g2/s4/work6", { css_files: 0 })
    ];
    const service = createService(rows, makeJob(3), [0, 0, 1, 1, -1], captured);

    const result = await service.getClusters(1, "run-1");

    expect(result.rowsTotal).toBe(6);
    expect(result.rowsUsed).toBe(5);
    expect(result.rowsExcluded).toBe(1);
    expect(result.rows.map((row) => row.cluster)).toEqual([0, 0, 1, 1]);
    expect(result.rows[0]).toMatchObject({
      path: "g1/s1/work1",
      groupPath: "g1/s1",
      metrics: expect.objectContaining({ extra_metric: 42 })
    });
    expect(captured.scaledInput?.[0]?.[0]).toBeCloseTo(Math.log1p(9));
    expect(captured.scaledInput?.[0]?.[12]).toBe(1);
  });

  it("fills missing feature values with feature median before scaling", async () => {
    const captured: { scaledInput?: number[][] } = {};
    const rows = [
      makeRow(1, "g1/s1/work1", { churn_ratio: 0.1 }),
      makeRow(2, "g1/s1/work2", { churn_ratio: 0.2 }),
      makeRow(3, "g1/s2/work3", { churn_ratio: null }),
      makeRow(4, "g2/s3/work4", { churn_ratio: 0.4 }),
      makeRow(5, "g2/s3/work5", { churn_ratio: 0.5 })
    ];
    const service = createService(rows, makeJob(3), [0, 0, 1, 1, -1], captured);

    await service.getClusters(1, "run-1");

    expect(captured.scaledInput?.[2]?.[1]).toBeCloseTo(0.3);
  });

  it("rejects negative values in log-transformed features", async () => {
    const rows = [
      makeRow(1, "g1/s1/work1"),
      makeRow(2, "g1/s1/work2"),
      makeRow(3, "g1/s2/work3", { active_days: -1 }),
      makeRow(4, "g2/s3/work4"),
      makeRow(5, "g2/s3/work5")
    ];
    const service = createService(rows);

    await expect(service.getClusters(1, "run-1")).rejects.toThrow(
      "В признаке active_days есть отрицательные значения"
    );
  });

  it("builds group share and distribution tables for depth - 1 groups", async () => {
    const rows = [
      makeRow(1, "g1/s1/work1"),
      makeRow(2, "g1/s1/work2"),
      makeRow(3, "g1/s2/work3"),
      makeRow(4, "g2/s3/work4"),
      makeRow(5, "g2/s3/work5")
    ];
    const service = createService(rows, makeJob(3), [0, 0, 1, 1, -1]);

    const result = await service.getClusters(1, "run-1");

    expect(result.groupDepth).toBe(2);
    expect(result.clusterSharesByGroup).toEqual([
      { groupPath: "g1/s1", total: 2, shares: { "0": 1, "1": 0 } },
      { groupPath: "g1/s2", total: 1, shares: { "0": 0, "1": 1 } },
      { groupPath: "g2/s3", total: 1, shares: { "0": 0, "1": 1 } }
    ]);
    expect(result.groupDistributionByCluster).toEqual([
      { cluster: 0, counts: { "g1/s1": 2, "g1/s2": 0, "g2/s3": 0 } },
      { cluster: 1, counts: { "g1/s1": 0, "g1/s2": 1, "g2/s3": 1 } }
    ]);
  });

  it("returns DBSCAN outliers from the dedicated endpoint", async () => {
    const rows = [
      makeRow(1, "g1/s1/work1"),
      makeRow(2, "g1/s1/work2"),
      makeRow(3, "g1/s2/work3"),
      makeRow(4, "g2/s3/work4"),
      makeRow(5, "g2/s3/work5")
    ];
    const service = createService(rows, makeJob(3), [0, 0, 1, 1, -1]);

    const result = await service.getOutliers(1, "run-1");

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      path: "g2/s3/work5",
      groupPath: "g2/s3",
      cluster: -1
    });
  });
});
