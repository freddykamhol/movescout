declare module "ssh2-sftp-client" {
  type ConnectConfig = {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
  };

  export default class SftpClient {
    connect(config: ConnectConfig): Promise<void>;
    exists(path: string): Promise<false | string>;
    list(path: string): Promise<unknown[]>;
    mkdir(path: string, recursive?: boolean): Promise<void>;
    get(path: string): Promise<Buffer | string | NodeJS.ReadableStream>;
    put(data: Buffer | NodeJS.ReadableStream, remotePath: string): Promise<void>;
    rename(from: string, to: string): Promise<void>;
    delete(path: string): Promise<void>;
    end(): Promise<void>;
  }
}
