const mongoose = require("mongoose");
const ApiError = require("./ApiError");

// Coerce a user-supplied id into a real ObjectId, rejecting anything that isn't
// a valid id — including query-operator objects like `{ $ne: null }` that would
// otherwise enable NoSQL injection when passed straight into a Mongoose query.
function toObjectId(value, label = "id") {
  if (!mongoose.isValidObjectId(value)) {
    throw new ApiError(400, `Invalid ${label}`);
  }
  return new mongoose.Types.ObjectId(String(value));
}

module.exports = toObjectId;
