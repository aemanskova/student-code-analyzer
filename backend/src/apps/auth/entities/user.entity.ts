import { Column, Entity, PrimaryGeneratedColumn, ManyToOne, Relation } from "typeorm";
import { Role } from "./role.entity";

@Entity("user")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  email!: string;

  @Column()
  password!: string;

  @Column()
  name!: string;

  @Column()
  surname!: string;

  @Column({ unique: true, nullable: true, type: "text" })
  github!: string | null;

  @Column()
  isActive!: boolean;

  @Column()
  createdAt!: Date;

  @Column()
  updatedAt!: Date;

  @Column({ type: "text", nullable: true })
  refreshTokenHash!: string | null;

  @Column({ type: "datetime", nullable: true })
  refreshTokenExpiresAt!: Date | null;

  @ManyToOne(() => Role, (role) => role.users, { eager: true })
  role!: Relation<Role>;
}
