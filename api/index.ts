import 'reflect-metadata';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory if present
dotenv.config({ path: path.join(__dirname, '../backend/.env') });
dotenv.config();

import app from '../backend/src/app';

export default app;
