import mongoose from "mongoose";

const botSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
);

export const BotSetting = mongoose.model("BotSetting", botSettingSchema);
