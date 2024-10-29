const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const applyToJSON = require('../middlewares/applyToJson');


const lectureSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    media: { type: Schema.Types.ObjectId, ref: 'Media' },
    slug: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lectureType: { type: String, required: true },
    published: { type: Boolean, default: false },
},

{
    timestamps: true,
  });



applyToJSON(lectureSchema);

module.exports = mongoose.model('Lecture', lectureSchema)