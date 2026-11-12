import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CreateProductDto, UpdateProductDto } from './products.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}
  @Post() create(@Body() input: CreateProductDto) { return this.products.create(input); }
  @Get() list() { return this.products.list(); }
  @Patch(':id') update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: UpdateProductDto) {
    return this.products.update(id, input);
  }
}
