import mongoose from "mongoose";
import productModel from "../model/product.model.js";
import projectModel from "../model/project.model.js";
import categoryModel from "../model/category.model.js";
import subCategoryModel from "../model/subCategory.model.js";
import brandModel from "../model/brand.model.js";
import comboModel from "../model/combo.model.js";

export default class SearchService {
  static async globalSearch(query) {
    const { search, page = 1, limit = 10 } = query;
    console.log("Searching for:", search);
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    if (!search) {
      return {
        products: [],
        projects: [],
        combos: [],
        pagination: { total: 0, page: parseInt(page), limit: limitNum },
      };
    }

    // 1. Identify matching IDs across all collections using Text Search and Regex
    const [
      textCategories, textSubCategories, textBrands,
      textProducts, textProjects, textCombos,
      regexCategories, regexSubCategories, regexBrands
    ] = await Promise.all([
      // Text Searches
      categoryModel.find({ $text: { $search: search } }, { _id: 1 }).lean(),
      subCategoryModel.find({ $text: { $search: search } }, { _id: 1 }).lean(),
      brandModel.find({ $text: { $search: search } }, { _id: 1 }).lean(),
      productModel.find({ $text: { $search: search } }, { _id: 1 }).lean(),
      projectModel.find({ $text: { $search: search } }, { _id: 1 }).lean(),
      comboModel.find({ $text: { $search: search } }, { _id: 1 }).lean(),
      // Regex Searches for Categories/Brands
      categoryModel.find({ title: { $regex: search, $options: "i" } }, { _id: 1 }).lean(),
      subCategoryModel.find({ title: { $regex: search, $options: "i" } }, { _id: 1 }).lean(),
      brandModel.find({ brandName: { $regex: search, $options: "i" } }, { _id: 1 }).lean(),
    ]);

    const categoryIds = [...new Set([...textCategories, ...regexCategories].map(c => c._id))];
    const subCategoryIds = [...new Set([...textSubCategories, ...regexSubCategories].map(s => s._id))];
    const brandIds = [...new Set([...textBrands, ...regexBrands].map(b => b._id))];
    const textProductIds = textProducts.map(p => p._id);
    const textProjectIds = textProjects.map(p => p._id);
    const textComboIds = textCombos.map(c => c._id);

    console.log("Found Category IDs:", categoryIds.length);
    console.log("Found Brand IDs:", brandIds.length);
    console.log("Found Product IDs (Text):", textProductIds.length);
    if (textProducts.length > 0) {
      const sample = await productModel.findById(textProducts[0]._id).lean();
      console.log("Sample Product Status (disable):", sample?.disable);
    }

    // 2. Search Products
    const productMatch = {
      disable: false,
      $or: [
        { _id: { $in: textProductIds } },
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { categoryId: { $in: categoryIds } },
        { subCategoryId: { $in: subCategoryIds } },
        { brandId: { $in: brandIds } },
      ],
    };

    const productPipeline = [
      { $match: productMatch },
      {
        $lookup: {
          from: "variants",
          let: { productId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$productId", "$$productId"] },
                disable: false,
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "variants",
        },
      },
      {
        $addFields: {
          variant: { $arrayElemAt: ["$variants", 0] },
        },
      },
      {
        $addFields: {
          price: "$variant.mrp",
          finalPrice: "$variant.finalPrice",
          discount: "$variant.discount",
          discountAmount: "$variant.discountAmount",
        },
      },
      { $project: { variants: 0, variant: 0 } },
      { $skip: skip },
      { $limit: limitNum },
    ];

    // 3. Search Projects
    const projectMatch = {
      disable: false,
      $or: [
        { _id: { $in: textProjectIds } },
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { category: { $in: categoryIds } },
        { subCategory: { $in: subCategoryIds } },
      ],
    };

    // 4. Search Combos
    const comboMatch = {
      disable: false,
      $or: [
        { _id: { $in: textComboIds } },
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { categories: { $in: categoryIds } },
        { subCategories: { $in: subCategoryIds } },
      ],
    };

    const [products, projects, combos, totalProducts, totalProjects, totalCombos] = await Promise.all([
      productModel.aggregate(productPipeline),
      projectModel.find(projectMatch).skip(skip).limit(limitNum).lean(),
      comboModel.find(comboMatch).skip(skip).limit(limitNum).lean(),
      productModel.countDocuments(productMatch),
      projectModel.countDocuments(projectMatch),
      comboModel.countDocuments(comboMatch),
    ]);

    console.log("Total Products Matched:", totalProducts);
    console.log("Total Projects Matched:", totalProjects);
    console.log("Total Combos Matched:", totalCombos);

    return {
      products,
      projects,
      combos,
      pagination: {
        totalProducts,
        totalProjects,
        totalCombos,
        page: parseInt(page),
        limit: limitNum,
        totalPages: Math.ceil(Math.max(totalProducts, totalProjects, totalCombos) / limitNum),
      },
    };
  }
}
