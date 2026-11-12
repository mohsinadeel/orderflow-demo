import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CreateProductDto, UpdateProductDto } from './products.dto.js';
import { ProductsService } from './products.service.js';
import { ApiBadRequestResponse, ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ErrorResponse, ProductResponse } from '../api-docs.models.js';

@Controller('products')
@ApiTags('products')
@ApiTooManyRequestsResponse({ type: ErrorResponse })
export class ProductsController {
  constructor(private readonly products: ProductsService) {}
  @Post()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create a synthetic product' })
  @ApiCreatedResponse({ type: ProductResponse })
  @ApiBadRequestResponse({ type: ErrorResponse })
  create(@Body() input: CreateProductDto) { return this.products.create(input); }

  @Get()
  @ApiOperation({ summary: 'List products and current availability' })
  @ApiOkResponse({ type: ProductResponse, isArray: true })
  list() { return this.products.list(); }

  @Patch(':id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Change product price or active state' })
  @ApiOkResponse({ type: ProductResponse })
  @ApiBadRequestResponse({ type: ErrorResponse })
  @ApiNotFoundResponse({ type: ErrorResponse })
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateProductDto) {
    return this.products.update(id, input);
  }
}
