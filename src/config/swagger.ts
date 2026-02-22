import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Snearal Unified Backend API',
            version: '1.0.0',
            description: 'API documentation for the Snearal Unified Backend, including User, Admin, and Partner APIs.',
            contact: {
                name: 'Snearal Dev Team',
                email: 'dev@snearal.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:4000/api/v1',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
