import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  name!: string;

  @IsString()
  surname!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  github?: string;

  @IsString()
  @MinLength(8)
  password!: string;

}
