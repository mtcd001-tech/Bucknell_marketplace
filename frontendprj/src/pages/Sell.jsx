import { useContext, useState } from "react";
import { ShopContext } from "../context/ShopContext";
import Title from "../components/Title";
import { toast } from "react-toastify";
import {
  CAMPUS_CATEGORIES,
  CONDITIONS,
  PICKUP_SPOTS,
} from "../mocks/marketplace";
import axios from "axios";

const MAX_PHOTOS = 4;

const Sell = () => {
  const { navigate, backendUrl, token, getListingsData } = useContext(ShopContext);

  const [photos, setPhotos] = useState([]);
  const [drafting, setDrafting] = useState(false);
  const [drafted, setDrafted] = useState(false);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [priceReasoning, setPriceReasoning] = useState("");
  const [missingInfo, setMissingInfo] = useState([]);
  // Ties this form back to the AI suggestion that prefilled it, so the backend
  // can record whether the seller kept or changed the suggested price.
  const [listingDraftId, setListingDraftId] = useState("");
  const [pickupArea, setPickupArea] = useState("");
  const [courseCode, setCourseCode] = useState("");

  const onPhotoChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotos((prev) => [...prev, ...files].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (index) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  // The draft only PREFILLS the form. Every field below stays a normal
  // editable input, so the seller reviews and changes anything before posting
  // -- they are never handed a locked-in result.
  const handleDraftWithAI = async () => {
    setDrafting(true);
    try {
      const formData = new FormData();
      photos.forEach((file) => formData.append("images", file));

      const response = await axios.post(
        backendUrl + "/api/ai/draft-listing",
        formData,
        { headers: { token } },
      );

      if (!response.data.success) {
        // The AI is unavailable or refused. That is not a blocker: the form is
        // already usable, so say so and let the seller type it themselves.
        toast.error(response.data.message || "Couldn't draft this one — fill it in manually.");
        return;
      }

      const draft = response.data.draft;
      setTitle(draft.title);
      setCategory(draft.category);
      setCondition(draft.condition);
      setDescription(draft.description);
      setPrice(String(draft.suggestedPrice));
      setPriceReasoning(draft.priceReasoning);
      setMissingInfo(draft.missingInfo || []);
      setListingDraftId(response.data.listingDraftId || "");
      setDrafted(true);
    } catch (error) {
      toast.error("Couldn't reach the drafting service — fill it in manually.");
      console.log("draft error:", error);
    } finally {
      setDrafting(false);
    }
  };

  const resetForm = () => {
    setPhotos([]);
    setDrafted(false);
    setTitle("");
    setCategory("");
    setCondition("");
    setDescription("");
    setPrice("");
    setPriceReasoning("");
    setMissingInfo([]);
    setListingDraftId("");
    setPickupArea("");
    setCourseCode("");
  };

  const onSubmitHandler = async (e) => {
    e.preventDefault();

    if (!title || !category || !condition || !description || !price || !pickupArea) {
      toast.error('Fill in title, category, condition, description, price, and pickup location.')
      return
    }

    if (photos.length === 0) {
      toast.error("Add at least one photo.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", title);
      formData.append("description", description);
      formData.append("price", price);
      formData.append("category", category);
      formData.append("condition", condition);
      formData.append("pickupLocation", pickupArea);
      formData.append("courseCode", courseCode);
      // Empty when the seller never used the AI -- the backend skips logging.
      formData.append("listingDraftId", listingDraftId);
      photos.forEach((file, i) => formData.append(`image${i + 1}`, file));

      const response = await axios.post(
        backendUrl + "/api/product/add",
        formData,
        { headers: { token } },
      );

      if (response.data.success) {
        toast.success("Listing posted");
        resetForm();
        await getListingsData();
        navigate("/account");
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="border-t pt-10 pb-20">
      <div className="text-2xl mb-6">
        <Title text1={"POST A"} text2={"LISTING"} />
      </div>

      <form onSubmit={onSubmitHandler} className="flex flex-col gap-5 max-w-xl">
        <div>
          <p className="mb-2 font-medium text-gray-700">Photos</p>
          <div className="flex flex-wrap gap-3">
            {photos.map((file, index) => (
              <div key={index} className="relative w-24 h-24">
                <img
                  src={URL.createObjectURL(file)}
                  className="w-24 h-24 object-cover border border-gray-300"
                  alt=""
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 bg-black text-white w-5 h-5 rounded-full text-xs leading-5"
                >
                  x
                </button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="w-24 h-24 border border-dashed border-gray-400 flex items-center justify-center cursor-pointer text-gray-400 text-2xl">
                +
                <input
                  onChange={onPhotoChange}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                />
              </label>
            )}
          </div>
        </div>

        {photos.length > 0 && (
          <button
            type="button"
            onClick={handleDraftWithAI}
            disabled={drafting}
            className="self-start border border-bucknell-blue text-bucknell-blue px-5 py-2 text-sm hover:bg-bucknell-blue hover:text-white transition disabled:opacity-50"
          >
            {drafting
              ? "Drafting…"
              : drafted
                ? "Re-draft with AI"
                : "Draft with AI"}
          </button>
        )}

        {drafting && (
          <p className="text-sm text-gray-500">
            Looking at your photos and writing a draft…
          </p>
        )}

        <div>
          <p className="mb-2 font-medium text-gray-700">Title</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="border border-gray-300 rounded py-2 px-3 w-full"
            type="text"
            placeholder="e.g. Organic Chemistry Textbook"
          />
        </div>

        <div className="flex gap-4 flex-col sm:flex-row">
          <div className="flex-1">
            <p className="mb-2 font-medium text-gray-700">Category</p>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="border border-gray-300 rounded py-2 px-3 w-full"
            >
              <option value="">Select a category</option>
              {CAMPUS_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <p className="mb-2 font-medium text-gray-700">Condition</p>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="border border-gray-300 rounded py-2 px-3 w-full"
            >
              <option value="">Select a condition</option>
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <p className="mb-2 font-medium text-gray-700">Description</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-gray-300 rounded py-2 px-3 w-full min-h-28"
            placeholder="Condition details, why you are selling, anything a buyer should know"
          />
        </div>

        <div>
          <p className="mb-2 font-medium text-gray-700">Price</p>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border border-gray-300 rounded py-2 px-3 w-full sm:w-40"
            type="number"
            min={0}
            placeholder="0"
          />
          {priceReasoning && (
            <p className="text-xs text-gray-500 mt-1">{priceReasoning}</p>
          )}
        </div>

        {missingInfo.length > 0 && (
          <p className="text-xs text-bucknell-orange">
            Consider adding: {missingInfo.join(", ")}
          </p>
        )}

        <div>
          <p className="mb-2 font-medium text-gray-700">Pickup Location</p>
          <select
            value={pickupArea}
            onChange={(e) => setPickupArea(e.target.value)}
            className="border border-gray-300 rounded py-2 px-3 w-full"
          >
            <option value="">Select a pickup spot</option>
            {PICKUP_SPOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="mb-2 font-medium text-gray-700">
            Course Code{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </p>
          <input
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            className="border border-gray-300 rounded py-2 px-3 w-full sm:w-48"
            type="text"
            placeholder="e.g. CHEM 201"
          />
        </div>

        <button
          type="submit"
          className="bg-bucknell-orange text-white px-8 py-3 text-sm self-start hover:opacity-90 transition"
        >
          Post Listing
        </button>
      </form>
    </div>
  );
};

export default Sell;
