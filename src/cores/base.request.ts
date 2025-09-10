import { Request } from 'express';
import jwt from 'jsonwebtoken';

class BaseRequest {
  public body: any;
  public params: any;
  public query: any;
  public headers: any;
  public file: any;

  constructor(req: Request) {
    this.body = req.body;
    this.params = req.params;
    this.query = req.query;
    this.headers = req.headers;
  }

  getCurrentUser(): string | null {
    try {
      const token = this.getAccessToken();
      if (token) {
        const decoded: any = jwt.decode(token);
        return decoded?.nameIdentifier || null;
      }
    } catch (error) { }

    return null;
  }

  getCurrentUserId(): string {
    try {
      const token = this.getAccessToken();
      if (token) {
        const decoded: any = jwt.decode(token);
        const userId = decoded?.userId;
        return userId;
      }
    } catch (error) { }

    return '';
  }

  getUserWalletAddress(): string {
    try {
      const token = this.getAccessToken();
      if (token) {
        const decoded: any = jwt.decode(token);
        const walletAddress = decoded?.address;
        return walletAddress;
      }
    } catch (error) { }

    return '';
  }

  isAdmin(): boolean {
    try {
      const token = this.getAccessToken();
      if (token) {
        const decoded: any = jwt.decode(token);
        const isAdmin = decoded?.isAdmin;
        return isAdmin || false;
      }
    } catch (error) { }

    return false;
  }

  getAccessToken(): string {
    const bearerToken = this.headers['authorization'] || '';
    if (bearerToken.startsWith('Bearer ')) {
      return bearerToken.replace('Bearer ', '').trim();
    }
    return '';
  }

  getIpAddress(): string | null {
    return this.headers.ip || this.headers.socket.remoteAddress || null;
  }
}

export default BaseRequest;
