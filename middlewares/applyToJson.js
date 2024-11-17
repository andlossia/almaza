const mongoose = require('mongoose');

function applyToJSON(schema) {
    schema.set('toJSON', {
        transform(doc, ret) {
            const transformed = {};
            transformed._id = ret._id ? ret._id.toString() : undefined; 

            const otherProps = {};

                Object.keys(ret).forEach((key) => {
                    if (!otherProps.hasOwnProperty(key) && key !== '__v' && key !== '_id') {
                        const value = ret[key];
                        if (value instanceof mongoose.Types.ObjectId) {
                            transformed[key] = value.toString(); 
                        } else if (Array.isArray(value)) {
                            transformed[key] = value.map(item => {
                                if (item && item._id instanceof mongoose.Types.ObjectId) {
                                    item._id = item._id.toString(); 
                                }
                                return item; 
                            });
                        } else if (value && typeof value === 'object') {
                            transformed[key] = Object.keys(value).reduce((acc, nestedKey) => {
                                if (value[nestedKey] instanceof mongoose.Types.ObjectId) {
                                    acc[nestedKey] = value[nestedKey].toString(); 
                                } else {
                                    acc[nestedKey] = value[nestedKey];
                                }
                                return acc;
                            }, {});
                        } else {
                            transformed[key] = value; 
                        }
                    }
                });

            Object.keys(schema.paths).forEach((path) => {
                if (path === '__v') return; 

                const pathType = schema.paths[path].instance;
                const schemaOptions = schema.paths[path].options;

                if (['String', 'Number', 'Date', 'Boolean'].includes(pathType)) {
                    otherProps[path] = ret[path];
                } else if (schemaOptions && schemaOptions.type) {
                    otherProps[path] = ret[path];
                } else if (pathType === 'Array' || Array.isArray(schemaOptions?.type)) {
                    otherProps[path] = ret[path].map(item => {
                        if (item && item._id instanceof mongoose.Types.ObjectId) {
                            item._id = item._id.toString(); 
                        }
                        return item; 
                    });
                } else if (pathType === 'Object') {
                    otherProps[path] = ret[path];
                }
            });

        

            if (ret.createdAt) transformed.createdAt = ret.createdAt;
            if (ret.updatedAt) transformed.updatedAt = ret.updatedAt;

         
            Object.assign(transformed, otherProps);

            return transformed;
        }
    });
}

module.exports = applyToJSON;
