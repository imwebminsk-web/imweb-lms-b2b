import { WithSiteHeader } from "@/components/site/with-site-header";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CoursePublicPage({ params }: PageProps) {
  await params;
  return (
    <WithSiteHeader>
      <p>Hello World</p>
    </WithSiteHeader>
  );
}
