import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OrderLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 2_147_483_647 })
  @IsInt() @Min(1) @Max(2_147_483_647)
  quantity!: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [OrderLineDto], minItems: 1, maxItems: 50 })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => OrderLineDto)
  items!: OrderLineDto[];
}
