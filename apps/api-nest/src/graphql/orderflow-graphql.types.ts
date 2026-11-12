import { Field, Float, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

@ObjectType('Product')
export class ProductType {
  @Field(() => ID) id!: string;
  @Field() name!: string;
  @Field() active!: boolean;
  @Field(() => Float) unitPriceMinor!: number;
  @Field() currency!: string;
  @Field(() => Int) stockAvailable!: number;
}

@ObjectType('OrderItem')
export class OrderItemType {
  @Field(() => ID) productId!: string;
  @Field() productName!: string;
  @Field(() => Float) unitPriceMinor!: number;
  @Field(() => Int) quantity!: number;
  @Field(() => Float) lineTotalMinor!: number;
}

@ObjectType('Order')
export class OrderType {
  @Field(() => ID) id!: string;
  @Field() status!: string;
  @Field() currency!: string;
  @Field(() => Float) totalMinor!: number;
  @Field(() => [OrderItemType]) items!: OrderItemType[];
}

@InputType()
export class CreateProductInput {
  @Field() @IsString() @IsNotEmpty() @MaxLength(160)
  name!: string;

  @Field(() => Float) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  unitPriceMinor!: number;

  @Field(() => Int) @IsInt() @Min(0) @Max(2_147_483_647)
  stockAvailable!: number;
}

@InputType()
export class UpdateProductInput {
  @Field(() => Float, { nullable: true }) @IsOptional() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  unitPriceMinor?: number;

  @Field({ nullable: true }) @IsOptional() @IsBoolean()
  active?: boolean;
}

@InputType()
export class OrderLineInput {
  @Field(() => ID) @IsUUID()
  productId!: string;

  @Field(() => Int) @IsInt() @Min(1) @Max(2_147_483_647)
  quantity!: number;
}

@InputType()
export class CreateOrderInput {
  @Field(() => [OrderLineInput])
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => OrderLineInput)
  items!: OrderLineInput[];

  @Field() @IsString() @IsNotEmpty() @MaxLength(120)
  idempotencyKey!: string;
}
