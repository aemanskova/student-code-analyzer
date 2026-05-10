import { PathParserService } from "./path-parser.service";

describe("PathParserService", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("normalizes separators and extracts default group and student segments", () => {
    delete process.env.PATH_GROUP_INDEX;
    delete process.env.PATH_STUDENT_INDEX;
    const service = new PathParserService();

    expect(service.parse("group\\student/work/index.html")).toEqual({
      path: "group/student/work/index.html",
      group: "group",
      student: "student"
    });
  });

  it("uses configured segment indexes and returns null for missing segments", () => {
    process.env.PATH_GROUP_INDEX = "1";
    process.env.PATH_STUDENT_INDEX = "3";
    const service = new PathParserService();

    expect(service.parse("/root/group/work")).toEqual({
      path: "/root/group/work",
      group: "group",
      student: null
    });
  });
});
