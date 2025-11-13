import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/Layout/DashboardLayout";
import { MoviChat } from "@/components/Movi/MoviChat";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api, type Route, type Path } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ManageRoute = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<Route>>({});
  const [createFormData, setCreateFormData] = useState<Partial<Route>>({
    status: "active",
  });

  // Fetch routes data
  const { data: routes = [], isLoading: routesLoading } = useQuery<Route[]>({
    queryKey: ["routes"],
    queryFn: () => api.getRoutes(),
  });

  // Fetch paths for edit form
  const { data: paths = [] } = useQuery<Path[]>({
    queryKey: ["paths"],
    queryFn: api.getPaths,
  });

  // Delete route mutation
  const deleteRouteMutation = useMutation({
    mutationFn: (routeId: string) => api.deleteRoute(routeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast({
        title: "Success",
        description: "Route deleted successfully",
      });
      setDeleteDialogOpen(false);
      setSelectedRoute(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete route",
        variant: "destructive",
      });
    },
  });

  // Update route mutation
  const updateRouteMutation = useMutation({
    mutationFn: ({ routeId, data }: { routeId: string; data: Partial<Route> }) =>
      api.updateRoute(routeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast({
        title: "Success",
        description: "Route updated successfully",
      });
      setEditDialogOpen(false);
      setSelectedRoute(null);
      setEditFormData({});
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update route",
        variant: "destructive",
      });
    },
  });

  // Create route mutation
  const createRouteMutation = useMutation({
    mutationFn: (data: Partial<Route>) =>
      api.createRoute({
        route_id: `R${Date.now()}`,
        path_id: data.path_id!,
        route_display_name: data.route_display_name!,
        shift_time: data.shift_time!,
        direction: data.direction!,
        start_point: data.start_point!,
        end_point: data.end_point!,
        capacity: Number(data.capacity || 0),
        allowed_waitlist: Number(data.allowed_waitlist || 0),
        status: (data.status as "active" | "deactivated") || "active",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["routes"] });
      toast({ title: "Success", description: "Route created successfully" });
      setCreateDialogOpen(false);
      setCreateFormData({ status: "active" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create route",
        variant: "destructive",
      });
    },
  });

  const activeRoutes = routes.filter((r) => r.status === "active");
  const deactivatedRoutes = routes.filter((r) => r.status === "deactivated");

  const filteredActiveRoutes = activeRoutes.filter((route) =>
    Object.values(route).some((value) =>
      value?.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const filteredDeactivatedRoutes = deactivatedRoutes.filter((route) =>
    Object.values(route).some((value) =>
      value?.toString().toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleEditClick = (route: Route) => {
    setSelectedRoute(route);
    setEditFormData({
      route_display_name: route.route_display_name,
      path_id: route.path_id,
      shift_time: route.shift_time,
      direction: route.direction,
      start_point: route.start_point,
      end_point: route.end_point,
      capacity: route.capacity,
      allowed_waitlist: route.allowed_waitlist,
      status: route.status,
    });
    setEditDialogOpen(true);
  };

  const handleDeleteClick = (route: Route) => {
    setSelectedRoute(route);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedRoute) {
      deleteRouteMutation.mutate(selectedRoute.route_id);
    }
  };

  const handleEditSubmit = () => {
    if (selectedRoute) {
      updateRouteMutation.mutate({
        routeId: selectedRoute.route_id,
        data: editFormData,
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Manage Routes</h1>
            <p className="text-sm text-muted-foreground mt-1">View and manage all transportation routes</p>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-80">
              <Input
                type="search"
                placeholder="Search routes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-secondary/60 focus-visible:ring-1"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2 rounded-full" onClick={() => setDownloadDialogOpen(true)}>
              <Download className="h-4 w-4" />
              Download
            </Button>
            <Button className="gap-2 rounded-full bg-gradient-primary" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Route
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 rounded-full">
            <TabsTrigger value="active" className="rounded-full">
              Active Routes ({filteredActiveRoutes.length})
            </TabsTrigger>
            <TabsTrigger value="deactivated" className="rounded-full">
              Deactivated ({filteredDeactivatedRoutes.length})
            </TabsTrigger>
          </TabsList>

          {/* Active Routes Table */}
          <TabsContent value="active" className="mt-6">
            <div className="rounded-xl border border-border bg-card shadow-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/60">
                    <TableHead className="font-semibold">Route ID</TableHead>
                    <TableHead className="font-semibold">Route Name</TableHead>
                    <TableHead className="font-semibold">Direction</TableHead>
                    <TableHead className="font-semibold">Shift Time</TableHead>
                    <TableHead className="font-semibold">Start Point</TableHead>
                    <TableHead className="font-semibold">End Point</TableHead>
                    <TableHead className="font-semibold">Capacity</TableHead>
                    <TableHead className="font-semibold">Waitlist</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routesLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-6"
                      >
                        Loading routes...
                      </TableCell>
                    </TableRow>
                  ) : filteredActiveRoutes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-6"
                      >
                        No active routes available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredActiveRoutes.map((route, index) => (
                      <TableRow
                        key={route.route_id}
                        className={cn(index % 2 === 0 ? "bg-background" : "bg-secondary/10", "hover:bg-secondary/40 transition-colors")}
                      >
                        <TableCell className="font-medium">
                          {route.route_id}
                        </TableCell>
                        <TableCell>{route.route_display_name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              route.direction === "Inbound" ? "default" : "secondary"
                            }
                          >
                            {route.direction}
                          </Badge>
                        </TableCell>
                        <TableCell>{route.shift_time}</TableCell>
                        <TableCell>{route.start_point}</TableCell>
                        <TableCell>{route.end_point}</TableCell>
                        <TableCell>{route.capacity}</TableCell>
                        <TableCell>{route.allowed_waitlist}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-full"
                              onClick={() => handleEditClick(route)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive rounded-full"
                              onClick={() => handleDeleteClick(route)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Deactivated Routes Table */}
          <TabsContent value="deactivated" className="mt-6">
            <div className="rounded-xl border border-border bg-card shadow-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/60">
                    <TableHead className="font-semibold">Route ID</TableHead>
                    <TableHead className="font-semibold">Route Name</TableHead>
                    <TableHead className="font-semibold">Direction</TableHead>
                    <TableHead className="font-semibold">Shift Time</TableHead>
                    <TableHead className="font-semibold">Start Point</TableHead>
                    <TableHead className="font-semibold">End Point</TableHead>
                    <TableHead className="font-semibold">Capacity</TableHead>
                    <TableHead className="font-semibold">Waitlist</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {routesLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-6"
                      >
                        Loading routes...
                      </TableCell>
                    </TableRow>
                  ) : filteredDeactivatedRoutes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-6"
                      >
                        No deactivated routes available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDeactivatedRoutes.map((route, index) => (
                      <TableRow
                        key={route.route_id}
                        className={cn(index % 2 === 0 ? "bg-background" : "bg-secondary/10", "hover:bg-secondary/40 transition-colors")}
                      >
                        <TableCell className="font-medium">
                          {route.route_id}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {route.route_display_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{route.direction}</Badge>
                        </TableCell>
                        <TableCell>{route.shift_time}</TableCell>
                        <TableCell>{route.start_point}</TableCell>
                        <TableCell>{route.end_point}</TableCell>
                        <TableCell>{route.capacity}</TableCell>
                        <TableCell>{route.allowed_waitlist}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-primary/10 hover:text-primary rounded-full"
                              onClick={() => handleEditClick(route)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <MoviChat />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Route?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete route{" "}
              <strong>{selectedRoute?.route_display_name}</strong>? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Route</DialogTitle>
            <DialogDescription>
              Update route information for {selectedRoute?.route_display_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="route_display_name">Route Display Name</Label>
                <Input
                  id="route_display_name"
                  value={editFormData.route_display_name || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      route_display_name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="path_id">Path</Label>
                <Select
                  value={editFormData.path_id || ""}
                  onValueChange={(value) =>
                    setEditFormData({ ...editFormData, path_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a path" />
                  </SelectTrigger>
                  <SelectContent>
                    {paths.map((path) => (
                      <SelectItem key={path.path_id} value={path.path_id}>
                        {path.path_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shift_time">Shift Time</Label>
                <Input
                  id="shift_time"
                  value={editFormData.shift_time || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, shift_time: e.target.value })
                  }
                  placeholder="e.g., 08:00 AM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="direction">Direction</Label>
                <Select
                  value={editFormData.direction || ""}
                  onValueChange={(value) =>
                    setEditFormData({ ...editFormData, direction: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inbound">Inbound</SelectItem>
                    <SelectItem value="Outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_point">Start Point</Label>
                <Input
                  id="start_point"
                  value={editFormData.start_point || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, start_point: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_point">End Point</Label>
                <Input
                  id="end_point"
                  value={editFormData.end_point || ""}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, end_point: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={editFormData.capacity || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      capacity: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allowed_waitlist">Allowed Waitlist</Label>
                <Input
                  id="allowed_waitlist"
                  type="number"
                  value={editFormData.allowed_waitlist || ""}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      allowed_waitlist: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={editFormData.status || "active"}
                onValueChange={(value: "active" | "deactivated") =>
                  setEditFormData({ ...editFormData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditFormData({});
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSubmit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Route</DialogTitle>
            <DialogDescription>Fill in details to create a new route</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cr_route_display_name">Route Display Name</Label>
                <Input
                  id="cr_route_display_name"
                  value={createFormData.route_display_name || ""}
                  onChange={(e) =>
                    setCreateFormData({
                      ...createFormData,
                      route_display_name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_path_id">Path</Label>
                <Select
                  value={createFormData.path_id || ""}
                  onValueChange={(value) =>
                    setCreateFormData({ ...createFormData, path_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a path" />
                  </SelectTrigger>
                  <SelectContent>
                    {paths.map((path) => (
                      <SelectItem key={path.path_id} value={path.path_id}>
                        {path.path_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cr_shift_time">Shift Time</Label>
                <Input
                  id="cr_shift_time"
                  value={createFormData.shift_time || ""}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, shift_time: e.target.value })
                  }
                  placeholder="e.g., 08:00 AM"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_direction">Direction</Label>
                <Select
                  value={createFormData.direction || ""}
                  onValueChange={(value) =>
                    setCreateFormData({ ...createFormData, direction: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select direction" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Inbound">Inbound</SelectItem>
                    <SelectItem value="Outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cr_start_point">Start Point</Label>
                <Input
                  id="cr_start_point"
                  value={createFormData.start_point || ""}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, start_point: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_end_point">End Point</Label>
                <Input
                  id="cr_end_point"
                  value={createFormData.end_point || ""}
                  onChange={(e) =>
                    setCreateFormData({ ...createFormData, end_point: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cr_capacity">Capacity</Label>
                <Input
                  id="cr_capacity"
                  type="number"
                  value={createFormData.capacity || ""}
                  onChange={(e) =>
                    setCreateFormData({
                      ...createFormData,
                      capacity: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr_allowed_waitlist">Allowed Waitlist</Label>
                <Input
                  id="cr_allowed_waitlist"
                  type="number"
                  value={createFormData.allowed_waitlist || ""}
                  onChange={(e) =>
                    setCreateFormData({
                      ...createFormData,
                      allowed_waitlist: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr_status">Status</Label>
              <Select
                value={createFormData.status || "active"}
                onValueChange={(value: "active" | "deactivated") =>
                  setCreateFormData({ ...createFormData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="deactivated">Deactivated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setCreateFormData({ status: "active" });
              }}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => createRouteMutation.mutate(createFormData)}>Create Route</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Dialog */}
      <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Download Routes</DialogTitle>
            <DialogDescription>Choose a format to download</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                // Generate CSV
                const header = [
                  "route_id",
                  "path_id",
                  "route_display_name",
                  "shift_time",
                  "direction",
                  "start_point",
                  "end_point",
                  "capacity",
                  "allowed_waitlist",
                  "status",
                ];
                const rows = routes.map((r) => [
                  r.route_id,
                  r.path_id,
                  r.route_display_name,
                  r.shift_time,
                  r.direction,
                  r.start_point,
                  r.end_point,
                  String(r.capacity),
                  String(r.allowed_waitlist),
                  r.status,
                ]);
                const csv = [header, ...rows]
                  .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","))
                  .join("\n");
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `routes_${Date.now()}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                setDownloadDialogOpen(false);
              }}
            >
              Excel (.csv)
            </Button>
            <Button
              className="rounded-full"
              onClick={async () => {
                try {
                  const res = await api.exportDb();
                  const url = URL.createObjectURL(res);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `moveinsync_${Date.now()}.db`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  toast({ title: "Error", description: "Failed to download DB", variant: "destructive" });
                } finally {
                  setDownloadDialogOpen(false);
                }
              }}
            >
              SQLite DB (.db)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ManageRoute;
