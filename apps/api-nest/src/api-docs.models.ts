import { ApiProperty } from '@nestjs/swagger';

export class ProductResponse {
  @ApiProperty({ format: 'uuid', example: 'c25be87a-7206-4e8b-a792-55073f52ef90' }) id!: string;
  @ApiProperty({ example: 'Synthetic desk lamp' }) name!: string;
  @ApiProperty({ example: true }) active!: boolean;
  @ApiProperty({ example: 1250, description: 'Price in integer minor currency units.' }) unitPriceMinor!: number;
  @ApiProperty({ example: 'USD' }) currency!: string;
  @ApiProperty({ example: 5 }) stockAvailable!: number;
}

export class OrderItemResponse {
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({ example: 'Synthetic desk lamp' }) productName!: string;
  @ApiProperty({ example: 1250 }) unitPriceMinor!: number;
  @ApiProperty({ example: 2 }) quantity!: number;
  @ApiProperty({ example: 2500 }) lineTotalMinor!: number;
}

export class OrderResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ['reserved', 'cancelled'], example: 'reserved' }) status!: 'reserved' | 'cancelled';
  @ApiProperty({ example: 'USD' }) currency!: string;
  @ApiProperty({ example: 2500 }) totalMinor!: number;
  @ApiProperty({ type: [OrderItemResponse] }) items!: OrderItemResponse[];
}

class ErrorDetail {
  @ApiProperty({ example: 'INSUFFICIENT_STOCK' }) code!: string;
  @ApiProperty({ example: 'Insufficient stock' }) message!: string;
}

export class ErrorResponse {
  @ApiProperty({ type: ErrorDetail }) error!: ErrorDetail;
}
