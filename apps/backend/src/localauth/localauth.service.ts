import { Injectable, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AuthHelper } from './utils/auth.helper';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { User, Prisma } from '../../generated/client';
import * as bcrypt from 'bcryptjs';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class LocalauthService {
    constructor(private prisma: PrismaService, private authHelper: AuthHelper) {}

    async createUser(data: SignupDto): Promise<{ name: string; email: string }> {
        const {fullName,email,password} = data;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await this.prisma.user.create({
            data: {
                email: email,
                name: fullName,
                password: hashedPassword,
                updatedAt: new Date()
            }
        });
        return { name: user.name, email: user.email };
    }

    async login(req:Request,data){
        const { email, password } = data;
        const user = await this.prisma.user.findUnique({
            where: { email }
        });
        if (user && await bcrypt.compare(password, user.password)) {
            const logindata = {
                id:user.id,
            }
            let {accessToken,refreshToken} = await this.authHelper.generateTokens(logindata,req);
            return {accessToken,refreshToken,user:{
                id:user.id,
                name:user.name,
                email:user.email
            }};
            // return user;
        }
        return null;
    }

    async refreshToken(req:Request,data){
        let {accessToken} = await this.authHelper.refreshAccessToken(data.refreshToken,req);
        return {accessToken};
    }

    async getSessions(req: any) {
        const sessions = await this.authHelper.getAllActiveSessions(req.user.id);
        
        return sessions.map(session => ({
            ip:session.ip,
            device:session.device,
            loggedInAt:session.logged
        }))
    }   
    async logout(req:Request){
        let {message} = await this.authHelper.logout(req);
        return {message};
    }
}
