import mongoose from "mongoose";

const addressSchema = new mongoose.Schema({
  country: {
    type: mongoose.Schema.ObjectId,
    ref: "Country",
  },

  state: {
    type: mongoose.Schema.ObjectId,
    ref: "State",
  },

  city: {
    type: mongoose.Schema.ObjectId,
    ref: "City",
  },

  pincode: {
    type: mongoose.Schema.ObjectId,
    ref: "Pincode",
  },

  street: {
    type: String,
    trim: true,
  },

  userId: {
    type: String,
    trim: true,
  },
});

const addressModel = mongoose.model("address", addressSchema);

export default addressModel;
