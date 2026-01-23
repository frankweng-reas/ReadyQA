import { IsString, IsNumber, Min, Max, IsNotEmpty } from 'class-validator';

export class GenerateCardsDto {
  @IsString()
  @IsNotEmpty()
  chatbot_id: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsNumber()
  @Min(1)
  @Max(20)
  card_count: number;
}

export class GenerateCardFromTitleDto {
  @IsString()
  @IsNotEmpty()
  chatbot_id: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  content: string;
}

export class FetchWebContentDto {
  @IsString()
  @IsNotEmpty()
  url: string;
}

export class OptimizeAnswerDto {
  @IsString()
  @IsNotEmpty()
  chatbot_id: string;

  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsNotEmpty()
  answer: string;
}
