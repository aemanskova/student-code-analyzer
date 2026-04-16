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

@Entity("analysis_result")
export class AnalysisResult {
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
  cacheKey!: string | null;

  @Column({ type: "text", nullable: true })
  groupValue!: string | null;

  @Column({ type: "text", nullable: true })
  studentValue!: string | null;

  @Column("simple-json")
  metrics!: Record<string, string | number | null>;

  @CreateDateColumn()
  createdAt!: Date;
}
