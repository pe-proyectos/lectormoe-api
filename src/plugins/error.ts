import { Elysia } from "elysia";

export const errorHandler = () => new Elysia()
    .onError({ as: "global" }, ({ code, error }) => {
        if (code === 'VALIDATION') {
            try {
                const validation = JSON.parse(error.message);
                return {
                    status: false,
                    error: code,
                    message: `${validation?.at || validation?.property || ''}: ${validation?.message}`,
                };
            } catch (err) {
                return {
                    status: false,
                    error: error?.code || code,
                    message: error?.message,
                };
            }
        }
        if (code === 'NOT_FOUND') {
            return {
                status: false,
                error: code,
                message: 'No se encontró el recurso.',
            };
        }

        if (error?.message == 'No se pudo verificar la sesión.') {
            return {
                status: false,
                error: code,
                message: error?.message,
            };
        }

        console.trace(error);
        console.error('not found')
        
        return {
            status: false,
            error: code,
            message: error?.message,
        };
    });
