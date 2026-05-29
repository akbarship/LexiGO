import mongoose from "mongoose";

const requiredChannelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    chatId: { type: String, required: true, unique: true, index: true },
    username: String,
    active: { type: Boolean, default: true },
    addedBy: Number
  },
  { timestamps: true }
);

export const RequiredChannel = mongoose.model("RequiredChannel", requiredChannelSchema);
