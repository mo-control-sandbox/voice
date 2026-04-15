import * as fs from 'fs';

export default fs;
export const createReadStream = fs.createReadStream;
export const createWriteStream = fs.createWriteStream;
export const existsSync = fs.existsSync;
export const mkdirSync = fs.mkdirSync;
export const promises = fs.promises;
export const readFileSync = fs.readFileSync;
export const rmSync = fs.rmSync;
export const statSync = fs.statSync;
export const writeFileSync = fs.writeFileSync;
