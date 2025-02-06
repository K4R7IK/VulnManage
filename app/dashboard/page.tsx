"use client";

import { Container, Card, Grid, Table, Text } from "@mantine/core";
import { BarChart, LineChart } from "@mantine/charts";

export default function DashboardPage() {
  // Dummy Data
  const chartData = [
    { label: "Jan", value: 40 },
    { label: "Feb", value: 55 },
    { label: "Mar", value: 75 },
    { label: "Apr", value: 60 },
    { label: "May", value: 90 },
  ];

  return (
    <Container fluid>
      <Text size="xl" fw={700} mb="md">
        Dashboard Overview
      </Text>

      {/* Charts Section */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Card withBorder p="md">
            <Text size="lg" fw={600} mb="sm">
              Sales Growth
            </Text>
            <BarChart
              h={200}
              data={chartData}
              dataKey="label"
              series={[{ name: "Sales", color: "blue" }]}
            />
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6 }}>
          <Card withBorder p="md">
            <Text size="lg" fw={600} mb="sm">
              Revenue
            </Text>
            <LineChart
              h={200}
              data={chartData}
              dataKey="label"
              series={[{ name: "Revenue", color: "green", dataKey: "value" }]}
            />
          </Card>
        </Grid.Col>
      </Grid>

      {/* Table Section */}
      <Card withBorder mt="lg">
        <Text size="lg" fw={600} mb="sm">
          Recent Transactions
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>1</Table.Td>
              <Table.Td>John Doe</Table.Td>
              <Table.Td>$200</Table.Td>
              <Table.Td>Completed</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>2</Table.Td>
              <Table.Td>Jane Smith</Table.Td>
              <Table.Td>$350</Table.Td>
              <Table.Td>Pending</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>3</Table.Td>
              <Table.Td>Michael Johnson</Table.Td>
              <Table.Td>$150</Table.Td>
              <Table.Td>Failed</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>
    </Container>
  );
}
