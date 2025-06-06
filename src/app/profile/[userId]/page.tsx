import { Metadata } from 'next';
import ProfileContent from './ProfileContent';

type PageProps = {
  params: Promise<{ userId: string }>;
  searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params: paramsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  return {
    title: `Profile - ${params.userId}`,
  };
}

export default async function Page({ params: paramsPromise }: PageProps) {
  const params = await paramsPromise;
  return <ProfileContent userId={params.userId} />;
}
