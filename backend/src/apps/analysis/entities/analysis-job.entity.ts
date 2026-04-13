import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export type AnalysisJobStatus = 'queued' | 'running' | 'success' | 'failed';

@Entity('analysis_job')
export class AnalysisJob {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column()
  userId!: number;

  @Column({ type: 'text' })
  direction!: string;

  @Column({ type: 'text' })
  status!: AnalysisJobStatus;

  @Column({ type: 'text', nullable: true })
  archiveName!: string | null;

  @Column({ type: 'integer', nullable: true })
  progressPercent!: number | null;

  @Column({ type: 'text', nullable: true })
  stage!: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column('simple-json', { nullable: true })
  requestPayload!: Record<string, unknown> | null;

  @Column('simple-json', { nullable: true })
  resultPayload!: Record<string, unknown> | null;

  @Column({ type: 'datetime', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  finishedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  heartbeatAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
