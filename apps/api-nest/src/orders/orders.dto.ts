import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsUUID, Max, Min, ValidateNested } from 'class-validator';

export class OrderLineDto {
  @IsUUID()
  productId!: string;

  @IsInt() @Min(1) @Max(2_147_483_647)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => OrderLineDto)
  items!: OrderLineDto[];
}
