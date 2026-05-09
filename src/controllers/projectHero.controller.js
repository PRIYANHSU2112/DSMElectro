// controllers/projectHero.controller.js

import ProjectHeroService from "../services/projectHeroService.js";

export default class ProjectHeroController {

    // ADMIN
    static async createOrUpdate(req, res) {
        try {
            const files = req.files || {};

            let cards = [];

            // parse cards safely
            if (req.body.cards) {
                try {
                    cards = JSON.parse(req.body.cards);
                } catch {
                    return res.status(400).json({ message: "Invalid cards JSON" });
                }
            }

            // map card icons
            if (files.cardIcons) {
                cards = cards.map((card, i) => ({
                    ...card,
                    icon: files.cardIcons[i]?.location || card.icon,
                }));
            }

            const payload = {
                pageTitle: req.body.pageTitle,
                subTitle: req.body.subTitle,
                description: req.body.description,
                pageIcon: files.pageIcon?.[0]?.location || null,
                cards,
            };

            const data = await ProjectHeroService.upsertHero(payload);

            res.json({
                success: true,
                message: "Hero section saved/updated",
                data,
            });

        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // USER
    static async getHero(req, res) {
        const data = await ProjectHeroService.getHero();

        res.json({
            success: true,
            data,
        });
    }
}