import { IsInt, IsNotEmpty, IsString, IsUrl, Min } from 'class-validator';

export class CreateMonitorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl()
  url: string;

  @IsInt()
  @Min(1)
  intervalMinutes: number;
}
