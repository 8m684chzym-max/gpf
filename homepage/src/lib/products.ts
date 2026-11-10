import polo from "@/assets/product-polo.jpg";
import cap from "@/assets/product-cap.jpg";
import balls from "@/assets/product-balls.jpg";
import glove from "@/assets/product-glove.jpg";

export type Product = {
  id: string;
  name: string;
  tagline: string;
  price: number;
  category: "Apparel" | "Accessories" | "Equipment";
  image: string;
  description: string;
};

export const products: Product[] = [
  {
    id: "signature-polo",
    name: "Signature Polo",
    tagline: "Featherweight performance piqué.",
    price: 95,
    category: "Apparel",
    image: polo,
    description:
      "A quietly technical polo cut from a two-way stretch piqué that breathes on the front nine and holds its shape on the back. Understated GPF crest at the chest.",
  },
  {
    id: "course-cap",
    name: "Course Cap",
    tagline: "Structured six-panel in matte black.",
    price: 45,
    category: "Apparel",
    image: cap,
    description:
      "Water-resistant twill with a soft moisture-wicking sweatband and a low, curved brim. Subtle tonal embroidery keeps the profile clean under sun and cloud.",
  },
  {
    id: "tour-balls-3pk",
    name: "Tour Balls, 3-Pack",
    tagline: "Tour urethane. Consistent flight.",
    price: 18,
    category: "Equipment",
    image: balls,
    description:
      "A four-piece construction engineered for tour spin around the green and controlled distance off the tee. Sold as a three-sleeve set.",
  },
  {
    id: "leather-glove",
    name: "Cabretta Glove",
    tagline: "Hand-cut cabretta leather.",
    price: 32,
    category: "Accessories",
    image: glove,
    description:
      "Buttery cabretta leather, precision-cut for a second-skin fit. Reinforced palm patch for grip in humid conditions, magnetic ball marker at the closure.",
  },
];

export function getProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
