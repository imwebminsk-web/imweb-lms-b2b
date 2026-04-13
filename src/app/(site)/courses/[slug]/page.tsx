type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CoursePublicPage({ params }: PageProps) {
  await params;
  return <p>Hello World</p>;
}
