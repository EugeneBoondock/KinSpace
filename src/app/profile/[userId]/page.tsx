import { Metadata } from 'next';
import ProfileContent from './ProfileContent';

type PageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function generateMetadata({ params: paramsPromise, searchParams: _searchParamsPromise }: PageProps): Promise<Metadata> {
  const params = await paramsPromise;
  return {
    title: `Profile - ${params.userId}`,
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function Page({ params: paramsPromise, searchParams: _searchParamsPromise }: PageProps) {
  const params = await paramsPromise;
  return <ProfileContent userId={params.userId} />;
}
