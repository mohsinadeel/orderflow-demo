import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ example: 'Synthetic desk lamp', maxLength: 160 })
  @IsString() @IsNotEmpty() @MaxLength(160)
  name!: string;

  @ApiProperty({ example: 1250, minimum: 1, description: 'Integer price in minor currency units.' })
  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  unitPriceMinor!: number;

  @ApiProperty({ example: 5, minimum: 0, maximum: 2_147_483_647 })
  @IsInt() @Min(0) @Max(2_147_483_647)
  stockAvailable!: number;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 1400, minimum: 1, description: 'Integer price in minor currency units.' })
  @IsOptional() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  unitPriceMinor?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean()
  active?: boolean;

  @ValidateIf(value => value.unitPriceMinor === undefined && value.active === undefined)
  @IsNotEmpty()
  private readonly atLeastOneField?: never;
}
