const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const applyToJSON = require('../middlewares/applyToJson');


const isValidUrl = (url) => {
    const regex = /^(ftp|http|https):\/\/[^ "]+$/;
    return regex.test(url);
};

const paragraphContentSchema = new Schema({
    type: { 
        type: String, 
        enum: ['text', 'image', 'video', 'link', 'list'], 
        required: true 
    },
    text: { 
        type: String, 
        required: function() { return this.type === 'text' || this.type === 'list'; },
        trim: true 
    },
    src: { 
        type: String, 
        required: function() { return this.type === 'image' || this.type === 'video'; },
        validate: {
            validator: isValidUrl,
            message: props => `${props.value} is not a valid URL!`
        }
    },
    items: [{ 
        text: { type: String, required: true, trim: true }, 
        style: { 
            bold: { type: Boolean, default: false }, 
            italic: { type: Boolean, default: false }, 
            underline: { type: Boolean, default: false }, 
            color: { type: String } 
        } 
    }], 
    href: { 
        type: String, 
        required: function() { return this.type === 'link'; },
        validate: {
            validator: isValidUrl,
            message: props => `${props.value} is not a valid URL!`
        }
    },
    style: {
        bold: { type: Boolean, default: false },
        italic: { type: Boolean, default: false },
        underline: { type: Boolean, default: false },
        color: { type: String },
        fontWeight: { type: String, default: 'normal' } 
    }
}, { _id: false });

const paragraphSchema = new Schema({
    tag: { 
        type: String, 
        default: 'p' 
    },
    content: { 
        type: [paragraphContentSchema], 
        validate: [arrayLimit, 'Content must have at least one element.']
    },
    style: {
        color: { type: String },
        fontWeight: { type: String, default: 'normal' }, 
        textAlign: { 
            type: String, 
            enum: ['left', 'right', 'center', 'justify'], 
            default: 'justify' 
        }, 
        direction: { 
            type: String, 
            enum: ['ltr', 'rtl', 'auto'], 
            default: 'auto' 
        }, 
        lineHeight: { type: Number, default: 1.5 } 
    }
}, {
    timestamps: true
});

function arrayLimit(val) {
    return val.length > 0; 
}


paragraphSchema.methods.getFormattedContent = function() {
    return this.content.map(item => {
        return {
            text: item.text || '',
            type: item.type,
            style: item.style
        };
    });
};

applyToJSON(paragraphSchema);

module.exports = mongoose.model('Paragraph', paragraphSchema);
