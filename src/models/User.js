const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['manager', 'teamlead', 'employee'];

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 2, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email address'],
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: ROLES, default: 'employee' },
    // Direct supervisor: for an employee this is their team lead, for a team lead this is their manager.
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // The manager at the top of this user's chain: for a team lead this is the same as reportsTo;
    // for an employee it's their team lead's manager. Lets any user's manager be read directly,
    // without walking reportsTo twice.
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role,
    reportsTo: this.reportsTo,
    managerId: this.managerId,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
