import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateProductDto {
  @IsString() @IsNotEmpty() @MaxLength(160)
  name!: string;

  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  unitPriceMinor!: number;

  @IsInt() @Min(0) @Max(2_147_483_647)
  stockAvailable!: number;
}

export class UpdateProductDto {
  @IsOptional() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  unitPriceMinor?: number;

  @IsOptional() @IsBoolean()
  active?: boolean;

  @ValidateIf(value => value.unitPriceMinor === undefined && value.active === undefined)
  @IsNotEmpty()
  private readonly atLeastOneField?: never;
}
