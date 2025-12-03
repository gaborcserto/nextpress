import * as yup from "yup";

export const TagCreateSchema = yup.object({
  name: yup.string().trim().required("Name is required"),
});

export type TagCreateInput = yup.InferType<typeof TagCreateSchema>;
