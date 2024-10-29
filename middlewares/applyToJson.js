function applyToJSON(schema) {
    schema.set('toJSON', {
        transform(doc, ret) {
            const transformed = {};
            transformed._id = ret._id;

            // Array to hold other properties
            const otherProps = {};

            Object.keys(schema.paths).forEach((path) => {
                // Skip version key
                if (path === '__v') return; 

                const pathType = schema.paths[path].instance;
                const schemaOptions = schema.paths[path].options;

                // Handle simple types
                if (['String', 'Number', 'Date', 'Boolean'].includes(pathType)) {
                    otherProps[path] = ret[path];
                } 
                // Handle custom types defined in schema options
                else if (schemaOptions && schemaOptions.type) {
                    otherProps[path] = ret[path];
                } 
                // Handle arrays
                else if (pathType === 'Array' || (Array.isArray(schemaOptions?.type))) {
                    otherProps[path] = ret[path];
                } 
            });

            // Include other properties first
            Object.assign(transformed, otherProps);

            // Include contactDetails last
            if (ret.contactDetails) transformed.contactDetails = ret.contactDetails;
            if (ret.bio) transformed.bio = ret.bio;
            

            // Include timestamps if they exist
            if (ret.createdAt) transformed.createdAt = ret.createdAt;
            if (ret.updatedAt) transformed.updatedAt = ret.updatedAt;

            return transformed;
        }
    });
}

module.exports = applyToJSON;
