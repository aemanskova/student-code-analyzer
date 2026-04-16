import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation
} from "typeorm";
import { User } from "../../auth/entities/user.entity";

@Entity("analysis_git_result")
export class AnalysisGitResult {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => User, { nullable: false, onDelete: "CASCADE" })
  @JoinColumn({ name: "userId" })
  user!: Relation<User>;

  @Column()
  userId!: number;

  @Column()
  runId!: string;

  @Column()
  direction!: string;

  @Column()
  path!: string;

  @Column({ type: "text", nullable: true })
  groupValue!: string | null;

  @Column({ type: "text", nullable: true })
  studentValue!: string | null;

  @Column({ type: "text" })
  branch!: string;

  @Column({ type: "text" })
  hash!: string;

  @Column({ type: "text" })
  date!: string;

  @Column({ type: "text" })
  message!: string;

  @Column({ type: "text" })
  author!: string;

  @Column({ type: "text" })
  filename!: string;

  @Column({ type: "text" })
  filetype!: "binary" | "text";

  @Column({ type: "text" })
  extraMetadata!: string;

  @Column({ type: "text" })
  changes!: string;

  @Column({ type: "integer" })
  added!: number;

  @Column({ type: "integer" })
  deleted!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
