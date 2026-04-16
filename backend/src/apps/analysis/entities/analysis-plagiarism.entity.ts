import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from "typeorm";
import type { PlagiarismHeatmapData } from "../analysis.types";

@Entity({ name: "analysis_plagiarism" })
@Unique(["userId", "runId"])
@Index(["userId", "runId"])
export class AnalysisPlagiarism {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "integer" })
  userId!: number;

  @Column({ type: "varchar", length: 64 })
  runId!: string;

  @Column({ type: "varchar", length: 32 })
  direction!: string;

  @Column({ type: "simple-json" })
  payload!: PlagiarismHeatmapData;

  @CreateDateColumn()
  createdAt!: Date;
}
