// Own ports so a run never collides with `pnpm dev` (3000 / 8080).
export const WEB_PORT = 3100;
export const API_PORT = 8180;
export const WEB = `http://localhost:${WEB_PORT}`;
