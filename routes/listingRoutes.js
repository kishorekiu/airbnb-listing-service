import express from "express";
import { getListingById, getListingsFeed } from "../controllers/listingController.js";

const router = express.Router();

router.get("/", getListingsFeed)
router.get("/:id", getListingById)

export default router;