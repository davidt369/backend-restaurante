import { PartialType } from '@nestjs/swagger';
import { CreatePlatoDto } from './create-plato.dto';

export class UpdatePlatoDto extends PartialType(CreatePlatoDto) {}
