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

export type AnalysisUploadStatus = 'uploaded' | 'processing' | 'done' | 'failed';

@Entity('analysis_upload')
export class AnalysisUpload {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: Relation<User>;

  @Column()
  userId!: number;

  @Column({ type: 'text' })
  originalName!: string;

  @Column({ type: 'text' })
  storedPath!: string;

  @Column({ type: 'integer' })
  size!: number;

  @Column({ type: 'text', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'text' })
  status!: AnalysisUploadStatus;

  @Column({ type: 'datetime', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
