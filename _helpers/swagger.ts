import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

export default function swaggerDocs(app: any) {
    const swaggerDocument = YAML.load('./swagger.yaml');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}