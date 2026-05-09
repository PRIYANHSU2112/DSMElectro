// services/projectHero.service.js

import ProjectHero from "../model/projectHero.model.js";

export default class ProjectHeroService {

  // CREATE / UPDATE (only one active)


  static async upsertHero(data) {
    return await ProjectHero.findOneAndUpdate(
      {}, // 👈 always same document
      { $set: data },
      {
        new: true,
        upsert: true, // create if not exists
      }
    );
  }

  static async getHero() {
    return await ProjectHero.findOne();
  }

  // GET ACTIVE HERO
  static async getHero() {
    return await ProjectHero.findOne({ isActive: true });
  }
}
