const sendAppointment = (Model) => [
  async (req, res) => {
    try {
      const item = await Model.create(req.body);
      res.status(201).json({
        message: `${Model.modelName} created successfully`,
        data: item.toJSON(),
      });
    } catch (error) {
      res.status(500).json({
        message: `Error creating ${Model.modelName}`,
        error: error.message,
      });
    }
  }
];


  module.exports = sendAppointment