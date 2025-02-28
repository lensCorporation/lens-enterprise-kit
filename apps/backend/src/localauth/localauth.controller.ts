import { Controller, Post, Body, UsePipes, Logger, Req, UseGuards, Get } from '@nestjs/common';
// import { User, Prisma } from '../../generated/client';
import { LocalauthService } from './localauth.service';
// import { JoiValidationPipe } from '../joi.validation.pipes';
// import signupSchema from './joiSchema/localauth.schema';
// import { SignInDto, SignUpDto } from './joiSchema/localauth.dto';
import { ApiBody, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from './localauth.guard';
import { SignupDto } from './dto/signup.dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

@Controller('localauth')
@ApiTags('localauth')
export class LocalauthController {
    private logger = new Logger(LocalauthController.name);

    constructor(private localAuthService: LocalauthService) {}

        @Post('signup')
        @ApiOperation({ summary: 'Sign up a new user' })
        @ApiResponse({ status: 201, description: 'User signed up successfully.' })
        @ApiResponse({ status: 400, description: 'Bad Request.' })
        @ApiProperty({ type: SignupDto })   
        async signup(@Body() data: SignupDto): Promise<{ name: string; email: string }> {
            try {
            return this.localAuthService.createUser(data);
            } catch (error) {
            this.logger.error('Error during signup', error);
            throw error;
            }
        }
        @Post('login')
        @Throttle({ default: { limit: 1, ttl: 6000 } })
        @UseGuards(ThrottlerGuard) 
        async login(@Body() data: any, @Req() req: Request): Promise<any> {
            return this.localAuthService.login(req, data);
        }
        @UseGuards(AuthGuard)
        @Get('getSessions')
        async getProfile(@Req() req){
            return await this.localAuthService.getSessions(req);
        }
        @UseGuards(AuthGuard)
        @Post('refreshToken')
        refreshToken(@Req() req:Request,@Body() Body:any){
            return this.localAuthService.refreshToken(req,{refreshToken:Body.token})
        }
        @UseGuards(AuthGuard)
        @Get('logout')
        logout(@Req() req:Request,@Body() Body:any){
            return this.localAuthService.logout(req)
        }
}