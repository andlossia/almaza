const { dynamicUpload } = require('../../../middlewares/uploadFilesMiddleware');
const { authenticate } = require('../../../middlewares/authenticationMiddleware');

const createItem = (Model, modelName, uniqueFields) => [
    authenticate,
    dynamicUpload(),
    uniqueFields(uniqueFields, Model, modelName),
    async (req, res) => {
        try {
            const item = await Model.create(req.body);
            res.status(201).json({
                message: `${modelName} created successfully`,
                data: item.toJSON(),
            });
        } catch (error) {
            res.status(500).json({
                message: `Error creating ${modelName}`,
                error: error.message,
            });
        }
    },
];

module.exports = createItem;
